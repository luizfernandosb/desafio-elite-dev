import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Dialog, useToast } from '../../../components'
import { createShareLink, revokeShareLink, type ShareLink } from '../api'
import { shareErrorMessage } from '../error-messages'
import styles from './ShareButton.module.css'

// Só o dia/hora de expiração importa aqui, sem o fuso do evento (§ etapa 09) --
// diferente de `formatEventDate`, que existe para mostrar a hora da SESSÃO no fuso
// dela; a validade do link é relevante no fuso de quem está lendo a tela.
function formatExpiry(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))
}

function RevokeShareDialog({ ticketId, onRevoked }: { ticketId: string; onRevoked: () => void }) {
  const [open, setOpen] = useState(false)
  const { showToast } = useToast()

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => revokeShareLink(ticketId),
    onSuccess: () => {
      showToast('Link revogado.', 'success')
      setOpen(false)
      onRevoked()
    },
  })

  return (
    <Dialog
      trigger={<Button variant="danger">Revogar link</Button>}
      title="Revogar link de compartilhamento?"
      description="Quem já tiver o link não vai mais conseguir usá-lo. Você pode gerar um novo depois."
      open={open}
      onOpenChange={setOpen}
    >
      {error && (
        <p role="alert" className={styles.error}>
          {shareErrorMessage(error)}
        </p>
      )}
      <Button variant="danger" loading={isPending} onClick={() => mutate()}>
        Confirmar revogação
      </Button>
    </Dialog>
  )
}

interface ShareButtonProps {
  ticketId: string
}

// Explica a semântica ANTES do clique, não depois (§ etapa 09, "omissão que parece
// descuido numa avaliação de UX") -- o aviso aparece nos dois estados (antes e
// depois de gerar o link), não só quando já existe um link para mostrar.
export function ShareButton({ ticketId }: ShareButtonProps) {
  const { showToast } = useToast()
  const [shareLink, setShareLink] = useState<ShareLink | null>(null)

  const {
    mutate: share,
    isPending: isSharing,
    error: shareError,
  } = useMutation({
    mutationFn: () => createShareLink(ticketId),
    onSuccess: setShareLink,
  })

  // `navigator.share` não existe em todo navegador (desktop, majoritariamente) --
  // cai para copiar a área de transferência, nunca falha silenciosamente
  async function handleShareOrCopy() {
    if (!shareLink) return
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Ingresso', url: shareLink.url })
        return
      } catch {
        // usuário cancelou o share nativo -- não é erro, só não faz nada
        return
      }
    }
    await navigator.clipboard.writeText(shareLink.url)
    showToast('Link copiado.', 'success')
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.notice}>
        Quem abrir o link consegue entrar com este ingresso -- revogue se compartilhar por engano.
      </p>

      {shareLink ? (
        <div className={styles.linkBox}>
          <code className={styles.link}>{shareLink.url}</code>
          <p className={styles.expiry}>Link válido até {formatExpiry(shareLink.expiresAt)}</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => void handleShareOrCopy()}>
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function'
                ? 'Compartilhar'
                : 'Copiar link'}
            </Button>
            <RevokeShareDialog ticketId={ticketId} onRevoked={() => setShareLink(null)} />
          </div>
        </div>
      ) : (
        <>
          {shareError && (
            <p role="alert" className={styles.error}>
              {shareErrorMessage(shareError)}
            </p>
          )}
          <Button variant="secondary" onClick={() => share()} loading={isSharing}>
            Compartilhar
          </Button>
        </>
      )}
    </div>
  )
}
