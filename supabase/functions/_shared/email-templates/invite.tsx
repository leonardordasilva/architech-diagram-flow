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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <EmailLayout
    siteName={siteName}
    siteUrl={siteUrl}
    previewText={`Você foi convidado para o ${siteName}`}
  >
    <Text style={styles.heading}>Você foi convidado 🎉</Text>
    <Text style={styles.text}>
      Você recebeu um convite para colaborar no{' '}
      <strong>{siteName}</strong>. Clique no botão abaixo para aceitar o
      convite e criar sua conta em poucos segundos.
    </Text>

    <div style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Aceitar convite
      </Button>
    </div>

    <FallbackLink url={confirmationUrl} />

    <HrDivider />

    <SecurityNotice>
      Se você não esperava este convite, pode ignorar este email com
      segurança.
    </SecurityNotice>
  </EmailLayout>
)

export default InviteEmail
