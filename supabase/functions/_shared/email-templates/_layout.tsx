/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailLayoutProps {
  siteName: string
  siteUrl: string
  previewText: string
  children: React.ReactNode
}

export const EmailLayout = ({
  siteName,
  siteUrl,
  previewText,
  children,
}: EmailLayoutProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{previewText}</Preview>
    <Body style={body}>
      <Container style={outer}>
        {/* Header com gradiente */}
        <Section style={header}>
          <Text style={brand}>{siteName}</Text>
        </Section>

        {/* Card */}
        <Section style={card}>{children}</Section>

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            Enviado por{' '}
            <Link href={siteUrl} style={footerLink}>
              {siteName}
            </Link>
          </Text>
          <Text style={footerMuted}>
            © {new Date().getFullYear()} {siteName}. Todos os direitos reservados.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const HrDivider = () => <Hr style={hr} />

export const SecurityNotice = ({ children }: { children: React.ReactNode }) => (
  <Text style={notice}>🔒 {children}</Text>
)

export const FallbackLink = ({ url }: { url: string }) => (
  <>
    <Text style={fallbackLabel}>
      Se o botão acima não funcionar, copie e cole o link abaixo no seu
      navegador:
    </Text>
    <Text style={fallbackUrl}>{url}</Text>
  </>
)

// ===== Estilos compartilhados =====

const body = {
  backgroundColor: '#ffffff',
  fontFamily:
    "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: 0,
}

const outer = {
  backgroundColor: '#f5f7fa',
  padding: '40px 16px',
  maxWidth: '100%',
  width: '100%',
}

const header = {
  background:
    'linear-gradient(135deg, hsl(220, 70%, 50%) 0%, hsl(217, 91%, 60%) 100%)',
  borderRadius: '12px 12px 0 0',
  padding: '28px 40px',
  maxWidth: '560px',
  margin: '0 auto',
}

const brand = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: 700 as const,
  letterSpacing: '-0.01em',
  margin: 0,
}

const card = {
  backgroundColor: '#ffffff',
  borderRadius: '0 0 12px 12px',
  padding: '40px',
  maxWidth: '560px',
  margin: '0 auto',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
}

const footer = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '24px 40px 0',
  textAlign: 'center' as const,
}

const footerText = {
  fontSize: '13px',
  color: 'hsl(220, 10%, 46%)',
  margin: '0 0 6px',
}

const footerLink = {
  color: 'hsl(220, 70%, 50%)',
  textDecoration: 'none',
  fontWeight: 600 as const,
}

const footerMuted = {
  fontSize: '11px',
  color: 'hsl(220, 8%, 60%)',
  margin: 0,
}

const hr = {
  border: 'none',
  borderTop: '1px solid hsl(220, 15%, 92%)',
  margin: '32px 0 20px',
}

const notice = {
  fontSize: '13px',
  color: 'hsl(220, 10%, 50%)',
  lineHeight: '1.5',
  margin: 0,
}

const fallbackLabel = {
  fontSize: '13px',
  color: 'hsl(220, 10%, 50%)',
  margin: '24px 0 6px',
}

const fallbackUrl = {
  fontSize: '12px',
  color: 'hsl(220, 70%, 50%)',
  wordBreak: 'break-all' as const,
  fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
  backgroundColor: 'hsl(220, 15%, 96%)',
  padding: '10px 12px',
  borderRadius: '6px',
  margin: 0,
}

// ===== Tokens reutilizáveis nos templates =====

export const styles = {
  heading: {
    fontSize: '24px',
    fontWeight: 700 as const,
    color: 'hsl(220, 25%, 10%)',
    letterSpacing: '-0.01em',
    margin: '0 0 16px',
    lineHeight: '1.3',
  },
  text: {
    fontSize: '15px',
    color: 'hsl(220, 15%, 35%)',
    lineHeight: '1.6',
    margin: '0 0 16px',
  },
  button: {
    display: 'inline-block',
    background:
      'linear-gradient(135deg, hsl(220, 70%, 50%) 0%, hsl(217, 91%, 60%) 100%)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600 as const,
    borderRadius: '8px',
    padding: '14px 28px',
    textDecoration: 'none',
    boxShadow: '0 4px 12px hsl(220, 70%, 50%, 0.25)',
    margin: '8px 0 8px',
  },
  buttonWrap: {
    textAlign: 'center' as const,
    margin: '28px 0',
  },
  link: {
    color: 'hsl(220, 70%, 50%)',
    textDecoration: 'underline',
    fontWeight: 500 as const,
  },
  otpBox: {
    backgroundColor: 'hsl(220, 15%, 96%)',
    border: '1px solid hsl(220, 15%, 88%)',
    borderRadius: '10px',
    padding: '24px',
    textAlign: 'center' as const,
    margin: '24px 0',
  },
  otpCode: {
    fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
    fontSize: '32px',
    fontWeight: 700 as const,
    letterSpacing: '8px',
    color: 'hsl(220, 25%, 10%)',
    margin: 0,
  },
  emailChange: {
    backgroundColor: 'hsl(220, 15%, 96%)',
    borderRadius: '10px',
    padding: '16px 20px',
    margin: '20px 0',
    fontSize: '14px',
    color: 'hsl(220, 25%, 10%)',
    lineHeight: '1.6',
  },
}
