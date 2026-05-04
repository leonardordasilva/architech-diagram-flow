/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Section, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, HrDivider, SecurityNotice, styles } from './_layout.tsx'

interface ReauthenticationEmailProps {
  siteName?: string
  siteUrl?: string
  token: string
}

export const ReauthenticationEmail = ({
  siteName = 'achitech-diagram-flow',
  siteUrl = 'https://achitech-diagram-flow.com.br',
  token,
}: ReauthenticationEmailProps) => (
  <EmailLayout
    siteName={siteName}
    siteUrl={siteUrl}
    previewText="Seu código de verificação"
  >
    <Text style={styles.heading}>Confirme sua identidade</Text>
    <Text style={styles.text}>
      Use o código abaixo para confirmar sua identidade no{' '}
      <strong>{siteName}</strong>:
    </Text>

    <Section style={styles.otpBox}>
      <Text style={styles.otpCode}>{token}</Text>
    </Section>

    <Text style={styles.text}>
      Este código expira em breve. Não compartilhe com ninguém.
    </Text>

    <HrDivider />

    <SecurityNotice>
      Se você não solicitou este código, ignore este email — sua conta
      continua segura.
    </SecurityNotice>
  </EmailLayout>
)

export default ReauthenticationEmail
