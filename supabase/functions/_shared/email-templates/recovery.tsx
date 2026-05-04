/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Text } from 'npm:@react-email/components@0.0.22'
import {
  EmailLayout,
  FallbackLink,
  HrDivider,
  SecurityNotice,
  styles,
} from './_layout.tsx'

interface RecoveryEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <EmailLayout
    siteName={siteName}
    siteUrl={siteUrl}
    previewText={`Redefina sua senha no ${siteName}`}
  >
    <Text style={styles.heading}>Redefinir sua senha</Text>
    <Text style={styles.text}>
      Recebemos uma solicitação para redefinir a senha da sua conta no{' '}
      <strong>{siteName}</strong>. Clique no botão abaixo para escolher uma
      nova senha.
    </Text>

    <div style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Criar nova senha
      </Button>
    </div>

    <FallbackLink url={confirmationUrl} />

    <HrDivider />

    <SecurityNotice>
      Se você não solicitou esta alteração, ignore este email com segurança.
      Sua senha atual continua válida e ninguém terá acesso à sua conta.
    </SecurityNotice>
  </EmailLayout>
)

export default RecoveryEmail
