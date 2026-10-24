import { Pencil, Plus, Wallet as WalletIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type {
  Network,
  Wallet,
  WalletInput,
  WalletProvider,
  WalletRole,
} from "@/api/contracts";
import { NETWORKS, WALLET_PROVIDERS } from "@/api/contracts";
import { ApiError } from "@/api/http";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert, Badge, Skeleton } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/overlays";
import { formatDate, NETWORK_LABEL, PROVIDER_LABEL } from "@/lib/utils";
import { useSaveWallet, useWallets } from "@/queries/account";

const ROLE_LABEL: Record<WalletRole, string> = {
  primary: "Principal",
  secondary: "Secundária",
};

/** Mesmas regras da API — validação no cliente para feedback imediato. */
export function validateWalletInput(
  input: WalletInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.label.trim().length < 2)
    errors.label = "Dê um nome à carteira (mín. 2 caracteres).";
  if (!input.networks.length) errors.networks = "Selecione ao menos uma rede.";
  const solana = input.networks.includes("solana");
  const evm = input.networks.some((n) => n !== "solana");
  const address = input.address.trim();
  if (solana && evm)
    errors.networks =
      "Solana não pode ser combinada com redes EVM na mesma carteira.";
  else if (!address) errors.address = "Informe o endereço público.";
  else if (solana && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))
    errors.address = "Endereço Solana inválido (base58, 32–44 caracteres).";
  else if (evm && !/^0x[a-fA-F0-9]{40}$/.test(address))
    errors.address =
      "Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.";
  return errors;
}

function WalletForm({
  role,
  wallet,
  onDone,
}: {
  role: WalletRole;
  wallet?: Wallet;
  onDone: () => void;
}) {
  const save = useSaveWallet();
  const [values, setValues] = useState<WalletInput>({
    role,
    label: wallet?.label ?? "",
    provider: wallet?.provider ?? "metamask",
    address: wallet?.address ?? "",
    networks: wallet?.networks ?? ["ethereum"],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const apiError = save.error instanceof ApiError ? save.error : null;
  const allErrors = { ...(apiError?.fields ?? {}), ...errors };

  const toggleNetwork = (n: Network) =>
    setValues((v) => ({
      ...v,
      networks: v.networks.includes(n)
        ? v.networks.filter((x) => x !== n)
        : [...v.networks, n],
    }));

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const found = validateWalletInput(values);
        setErrors(found);
        if (Object.keys(found).length) return;
        save.mutate(
          {
            id: wallet?.id,
            input: {
              ...values,
              address: values.address.trim(),
              label: values.label.trim(),
            },
          },
          {
            onSuccess: () => {
              toast.success(
                wallet ? "Carteira atualizada." : "Carteira cadastrada.",
              );
              onDone();
            },
          },
        );
      }}
    >
      {apiError && !Object.keys(apiError.fields).length && (
        <Alert variant="danger" title="Não foi possível salvar" role="alert">
          {apiError.message}
        </Alert>
      )}
      <Field label="Nome da carteira" error={allErrors.label}>
        {(p) => (
          <Input
            {...p}
            value={values.label}
            onChange={(e) =>
              setValues((v) => ({ ...v, label: e.target.value }))
            }
            placeholder="Ex.: MetaMask pessoal"
          />
        )}
      </Field>
      <Field label="Provedor" error={allErrors.provider}>
        {(p) => (
          <NativeSelect
            {...p}
            value={values.provider}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                provider: e.target.value as WalletProvider,
              }))
            }
          >
            {WALLET_PROVIDERS.map((w) => (
              <option key={w} value={w}>
                {PROVIDER_LABEL[w]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <fieldset
        aria-describedby={allErrors.networks ? "networks-error" : undefined}
      >
        <legend className="mb-2 text-sm font-medium">Redes</legend>
        <div className="flex flex-wrap gap-4">
          {NETWORKS.map((n) => (
            <label key={n} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.networks.includes(n)}
                onCheckedChange={() => toggleNetwork(n)}
                aria-invalid={!!allErrors.networks}
              />
              {NETWORK_LABEL[n]}
            </label>
          ))}
        </div>
        {allErrors.networks && (
          <p id="networks-error" className="mt-1 text-xs text-danger">
            ⚠ {allErrors.networks}
          </p>
        )}
      </fieldset>
      <Field
        label="Endereço público"
        error={allErrors.address}
        hint="Nunca informe sua frase de recuperação ou chave privada."
      >
        {(p) => (
          <Input
            {...p}
            value={values.address}
            onChange={(e) =>
              setValues((v) => ({ ...v, address: e.target.value }))
            }
            placeholder={
              values.networks.includes("solana") ? "Endereço base58" : "0x…"
            }
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={save.isPending}>
          Salvar carteira
        </Button>
      </div>
    </form>
  );
}

function WalletCard({
  role,
  wallet,
  onEdit,
}: {
  role: WalletRole;
  wallet?: Wallet;
  onEdit: () => void;
}) {
  return (
    <article
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 md:p-6"
      aria-labelledby={`wallet-${role}`}
      data-testid={`wallet-${role}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id={`wallet-${role}`}
          className="flex items-center gap-2 text-lg font-bold"
        >
          <WalletIcon className="size-5 text-accent-text" aria-hidden />{" "}
          Carteira {ROLE_LABEL[role].toLowerCase()}
        </h2>
        {wallet && (
          <Badge variant="outline">{PROVIDER_LABEL[wallet.provider]}</Badge>
        )}
      </div>
      {wallet ? (
        <>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-fg-muted">Nome</dt>
              <dd className="font-bold">{wallet.label}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Endereço</dt>
              <dd className="break-all font-mono text-xs">{wallet.address}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Redes</dt>
              <dd className="flex flex-wrap gap-1">
                {wallet.networks.map((n) => (
                  <Badge key={n} variant="outline">
                    {NETWORK_LABEL[n]}
                  </Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted">Atualizada em</dt>
              <dd>{formatDate(wallet.updatedAt)}</dd>
            </div>
          </dl>
          <Button
            variant="outline"
            className="self-start"
            onClick={onEdit}
            aria-label={`Editar carteira ${ROLE_LABEL[role].toLowerCase()}`}
          >
            <Pencil aria-hidden /> Editar
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-fg-muted">
            Nenhuma carteira {ROLE_LABEL[role].toLowerCase()} cadastrada.
          </p>
          <Button className="self-start" onClick={onEdit}>
            <Plus aria-hidden /> Cadastrar carteira{" "}
            {ROLE_LABEL[role].toLowerCase()}
          </Button>
        </>
      )}
    </article>
  );
}

export function WalletsPage() {
  const wallets = useWallets();
  const [editing, setEditing] = useState<WalletRole | null>(null);
  const byRole = (role: WalletRole) =>
    wallets.data?.items.find((w) => w.role === role);

  return (
    <div className="container-kurio flex flex-col gap-8 pt-8">
      <div>
        <h1 className="text-[28px] font-bold md:text-4xl">Carteiras</h1>
        <p className="mt-2 max-w-2xl text-fg-muted">
          Cadastre até duas carteiras para pagar seus pedidos. A conexão com a
          carteira é simulada nesta demonstração — nenhuma extensão é acionada.
        </p>
      </div>
      {wallets.isPending ? (
        <div
          className="grid gap-6 md:grid-cols-2"
          aria-busy="true"
          aria-label="Carregando carteiras"
        >
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : wallets.isError ? (
        <ErrorState
          error={wallets.error}
          onRetry={() => void wallets.refetch()}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <WalletCard
            role="primary"
            wallet={byRole("primary")}
            onEdit={() => setEditing("primary")}
          />
          <WalletCard
            role="secondary"
            wallet={byRole("secondary")}
            onEdit={() => setEditing("secondary")}
          />
        </div>
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          {editing && (
            <>
              <DialogTitle>
                {byRole(editing) ? "Editar" : "Cadastrar"} carteira{" "}
                {ROLE_LABEL[editing].toLowerCase()}
              </DialogTitle>
              <DialogDescription>
                Informe apenas o endereço público da carteira.
              </DialogDescription>
              <WalletForm
                key={editing}
                role={editing}
                wallet={byRole(editing)}
                onDone={() => setEditing(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
