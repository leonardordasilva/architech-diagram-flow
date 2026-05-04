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

interface MagicLinkEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <EmailLayout
    siteName={siteName}
    siteUrl={siteUrl}
    previewText={`Seu link de acesso ao ${siteName}`}
  >
    <Text style={styles.heading}>Seu link de acesso</Text>
    <Text style={styles.text}>
      Clique no botão abaixo para entrar no <strong>{siteName}</strong> sem
      precisar digitar sua senha.
    </Text>

    <div style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Entrar agora
      </Button>
    </div>

    <Text style={styles.text}>
      Este link expira em breve por motivos de segurança e só pode ser usado
      uma vez.
    </Text>

    <FallbackLink url={confirmationUrl} />

    <HrDivider />

    <SecurityNotice>
      Se você não solicitou este link de acesso, pode ignorar este email — sua
      conta continua protegida.
    </SecurityNotice>
  </EmailLayout>
)

export default MagicLinkEmail
