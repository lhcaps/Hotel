export interface SMTPMessage {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly messageId: string;
}

export interface SMTPTransport {
  readonly send: (message: SMTPMessage) => Promise<void>;
  readonly close: () => Promise<void>;
}

export interface SMTPTransportConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user?: string;
  readonly password?: string;
  readonly requireAuth: boolean;
}

export function validateSMTPTransportConfig(config: SMTPTransportConfig): void {
  if (typeof config.host !== 'string' || config.host.trim() === '') {
    throw new RangeError('SMTP host must be a non-empty string');
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new RangeError('SMTP port must be an integer between 1 and 65535');
  }
  if (typeof config.secure !== 'boolean') {
    throw new RangeError('SMTP secure flag must be a boolean');
  }
  if (config.requireAuth) {
    if (typeof config.user !== 'string' || config.user.length === 0) {
      throw new RangeError('SMTP user must be provided when authentication is required');
    }
    if (typeof config.password !== 'string' || config.password.length === 0) {
      throw new RangeError('SMTP password must be provided when authentication is required');
    }
  }
}

export function createSMTPTransport(
  config: SMTPTransportConfig,
  nodemailer: typeof import('nodemailer'),
): SMTPTransport {
  validateSMTPTransportConfig(config);

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.requireAuth
      ? { auth: { user: config.user ?? '', pass: config.password ?? '' } }
      : {}),
  });

  return {
    send: async (message) => {
      await transport.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        messageId: message.messageId,
        envelope: {
          from: message.from,
          to: [message.to],
        },
      });
    },
    close: async () => {
      transport.close();
    },
  };
}
