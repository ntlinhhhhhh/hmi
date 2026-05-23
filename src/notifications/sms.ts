export type SendSmsInput = {
  to: string;
  body: string;
};

export type SendSmsResult = {
  provider: "textbee";
  messageId: string;
  status: string | null;
};

type SmsSendErrorType = "SMS_CONFIGURATION_ERROR" | "SMS_DELIVERY_ERROR";

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

type TextBeeConfig = {
  apiKey: string;
  deviceId: string;
  simSubscriptionId: number | null;
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

function readOptionalIntegerEnv(name: string): number | null {
  const value = readOptionalEnv(name);
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new SmsSendError(
      "SMS_CONFIGURATION_ERROR",
      `${name} must be a non-negative integer when configured.`,
    );
  }

  return parsed;
}

function readTextBeeConfig(): TextBeeConfig {
  return {
    apiKey: readRequiredEnv("TEXTBEE_API_KEY"),
    deviceId: readRequiredEnv("TEXTBEE_DEVICE_ID"),
    simSubscriptionId: readOptionalIntegerEnv("TEXTBEE_SIM_SUBSCRIPTION_ID"),
    apiBaseUrl: readOptionalEnv("TEXTBEE_API_BASE_URL") ?? "https://api.textbee.dev/api/v1",
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

function getMessageId(value: unknown): string | null {
  return (
    getStringField(value, "id") ??
    getStringField(value, "smsId") ??
    getStringField(value, "smsBatchId") ??
    getStringField(value, "messageId")
  );
}

function getProviderMessage(value: unknown): string | null {
  return getStringField(value, "message") ?? getStringField(value, "error");
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

  const config = readTextBeeConfig();
  const payload: {
    recipients: string[];
    message: string;
    simSubscriptionId?: number;
  } = {
    recipients: [to],
    message: body,
  };

  if (config.simSubscriptionId !== null) {
    payload.simSubscriptionId = config.simSubscriptionId;
  }

  let response: Response;
  try {
    response = await fetch(
      `${config.apiBaseUrl}/gateway/devices/${encodeURIComponent(config.deviceId)}/send-sms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
        },
        body: JSON.stringify(payload),
      },
    );
  } catch (error) {
    throw new SmsSendError("SMS_DELIVERY_ERROR", "SMS provider request failed.", { cause: error });
  }

  const responseBody = await readJsonBody(response);
  if (!response.ok) {
    const providerMessage = getProviderMessage(responseBody);
    throw new SmsSendError(
      "SMS_DELIVERY_ERROR",
      providerMessage
        ? `SMS provider rejected the message: ${providerMessage}`
        : "SMS provider rejected the message.",
      {
        providerStatus: response.status,
        providerCode: getProviderCode(responseBody),
      },
    );
  }

  return {
    provider: "textbee",
    messageId: getMessageId(responseBody) ?? "accepted",
    status: getStringField(responseBody, "status"),
  };
}
