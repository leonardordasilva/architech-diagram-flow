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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <EmailLayout
    siteName={siteName}
    siteUrl={siteUrl}
    previewText={`Confirme seu email para ativar sua conta no ${siteName}`}
  >
    <Text style={styles.heading}>Confirme seu email</Text>
    <Text style={styles.text}>
      Bem-vindo ao <strong>{siteName}</strong>! Estamos animados em ter você
      por aqui.
    </Text>
    <Text style={styles.text}>
      Para começar, confirme que <strong>{recipient}</strong> é seu endereço
      de email clicando no botão abaixo:
    </Text>

    <div style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Verificar meu email
      </Button>
    </div>

    <FallbackLink url={confirmationUrl} />

    <HrDivider />

    <SecurityNotice>
      Se você não criou uma conta no {siteName}, pode ignorar este email com
      segurança — nada será criado sem sua confirmação.
    </SecurityNotice>
  </EmailLayout>
)

export default SignupEmail
