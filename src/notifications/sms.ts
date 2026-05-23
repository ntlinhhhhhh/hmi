import { Buffer } from "node:buffer";

export type SendSmsInput = {
  to: string;
  body: string;
};

export type SendSmsResult = {
  provider: "twilio";
  messageId: string;
  status: string | null;
};

type SmsSendErrorType = "SMS_CONFIGURATION_ERROR" | "SMS_PROVIDER_ERROR";

export class SmsSendError extends Error {
  readonly type: SmsSendErrorType;
  readonly providerStatus: number | null;
  readonly providerCode: string | null;

  constructor(
    type: SmsSendErrorType,
    message: string,
    options: {
      providerStatus?: number | null;
      providerCode?: string | null;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "SmsSendError";
    this.type = type;
    this.providerStatus = options.providerStatus ?? null;
    this.providerCode = options.providerCode ?? null;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string | null;
  fromPhoneNumber: string | null;
  apiBaseUrl: string;
};

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readRequiredEnv(name: string): string {
  const value = readOptionalEnv(name);
  if (!value) {
    throw new SmsSendError(
      "SMS_CONFIGURATION_ERROR",
      `Missing required SMS environment variable: ${name}.`,
    );
  }

  return value;
}

function readTwilioConfig(): TwilioConfig {
  const provider = readOptionalEnv("SMS_PROVIDER") ?? "twilio";
  if (provider.toLowerCase() !== "twilio") {
    throw new SmsSendError(
      "SMS_CONFIGURATION_ERROR",
      `Unsupported SMS_PROVIDER '${provider}'. Supported provider: twilio.`,
    );
  }

  const messagingServiceSid = readOptionalEnv("TWILIO_MESSAGING_SERVICE_SID");
  const fromPhoneNumber = readOptionalEnv("TWILIO_FROM_PHONE_NUMBER");
  if (!messagingServiceSid && !fromPhoneNumber) {
    throw new SmsSendError(
      "SMS_CONFIGURATION_ERROR",
      "Either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_PHONE_NUMBER is required.",
    );
  }

  return {
    accountSid: readRequiredEnv("TWILIO_ACCOUNT_SID"),
    authToken: readRequiredEnv("TWILIO_AUTH_TOKEN"),
    messagingServiceSid,
    fromPhoneNumber,
    apiBaseUrl: readOptionalEnv("TWILIO_API_BASE_URL") ?? "https://api.twilio.com/2010-04-01",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(value: unknown, field: string): string | null {
  if (!isRecord(value)) return null;

  const fieldValue = value[field];
  return typeof fieldValue === "string" && fieldValue.trim() ? fieldValue : null;
}

function getProviderCode(value: unknown): string | null {
  if (!isRecord(value)) return null;

  const code = value["code"];
  if (typeof code === "string" && code.trim()) return code;
  if (typeof code === "number" && Number.isFinite(code)) return String(code);
  return null;
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const to = input.to.trim();
  const body = input.body.trim();

  if (!to || !body) {
    throw new SmsSendError("SMS_CONFIGURATION_ERROR", "SMS recipient and body are required.");
  }

  const config = readTwilioConfig();
  const payload = new URLSearchParams({
    To: to,
    Body: body,
  });

  if (config.messagingServiceSid) {
    payload.set("MessagingServiceSid", config.messagingServiceSid);
  } else if (config.fromPhoneNumber) {
    payload.set("From", config.fromPhoneNumber);
  }

  let response: Response;
  try {
    response = await fetch(
      `${config.apiBaseUrl}/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
      },
    );
  } catch (error) {
    throw new SmsSendError("SMS_PROVIDER_ERROR", "SMS provider request failed.", { cause: error });
  }

  const responseBody = await readJsonBody(response);
  if (!response.ok) {
    throw new SmsSendError("SMS_PROVIDER_ERROR", "SMS provider rejected the message.", {
      providerStatus: response.status,
      providerCode: getProviderCode(responseBody),
    });
  }

  const messageId = getStringField(responseBody, "sid");
  if (!messageId) {
    throw new SmsSendError("SMS_PROVIDER_ERROR", "SMS provider returned an invalid response.", {
      providerStatus: response.status,
    });
  }

  return {
    provider: "twilio",
    messageId,
    status: getStringField(responseBody, "status"),
  };
}
