/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22'
import {
  EmailLayout,
  FallbackLink,
  HrDivider,
  SecurityNotice,
  styles,
} from './_layout.tsx'

interface EmailChangeEmailProps {
  siteName: string
  siteUrl: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  siteUrl,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailLayout
    siteName={siteName}
    siteUrl={siteUrl}
    previewText={`Confirme a alteração de email no ${siteName}`}
  >
    <Text style={styles.heading}>Confirme a alteração de email</Text>
    <Text style={styles.text}>
      Você solicitou alterar o email da sua conta no{' '}
      <strong>{siteName}</strong>. Confira os detalhes:
    </Text>

    <Section style={styles.emailChange}>
      <Text style={{ margin: 0, fontSize: '13px', color: 'hsl(220, 10%, 50%)' }}>
        De
      </Text>
      <Text style={{ margin: '2px 0 12px', fontSize: '15px', fontWeight: 600 }}>
        {email}
      </Text>
      <Text style={{ margin: 0, fontSize: '13px', color: 'hsl(220, 10%, 50%)' }}>
        Para
      </Text>
      <Text
        style={{
          margin: '2px 0 0',
          fontSize: '15px',
          fontWeight: 600,
          color: 'hsl(220, 70%, 50%)',
        }}
      >
        {newEmail}
      </Text>
    </Section>

    <Text style={styles.text}>
      Clique no botão abaixo para confirmar essa alteração:
    </Text>

    <div style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Confirmar alteração
      </Button>
    </div>

    <FallbackLink url={confirmationUrl} />

    <HrDivider />

    <SecurityNotice>
      Se você não solicitou essa alteração, proteja sua conta imediatamente
      alterando sua senha.
    </SecurityNotice>
  </EmailLayout>
)

export default EmailChangeEmail
