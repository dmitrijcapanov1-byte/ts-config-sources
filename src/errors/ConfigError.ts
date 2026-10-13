export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ConfigSourceError extends ConfigError {
  constructor(
    public readonly sourceName: string,
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(`[${sourceName}] ${message}`);
    this.name = 'ConfigSourceError';
  }
}

export class ConfigComposerError extends ConfigError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigComposerError';
  }
}
