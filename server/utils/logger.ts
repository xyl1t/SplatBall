export const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  fgBlack: "\x1b[30m",
  fgRed: "\x1b[31m",
  fgGreen: "\x1b[32m",
  fgYellow: "\x1b[33m",
  fgBlue: "\x1b[34m",
  fgMagenta: "\x1b[35m",
  fgCyan: "\x1b[36m",
  fgWhite: "\x1b[37m",
  fgGray: "\x1b[90m",

  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
  bgGray: "\x1b[100m",
};

export function gray(text: string) {
  return colors.fgGray + text + colors.reset;
}

export function white(text: string) {
  return colors.fgWhite + text + colors.reset;
}

export function cyan(text: string) {
  return colors.fgCyan + text + colors.reset;
}

export function magenta(text: string) {
  return colors.fgMagenta + text + colors.reset;
}

export function blue(text: string) {
  return colors.fgBlue + text + colors.reset;
}

export function yellow(text: string) {
  return colors.fgYellow + text + colors.reset;
}

export function green(text: string) {
  return colors.fgGreen + text + colors.reset;
}

export function red(text: string) {
  return colors.fgRed + text + colors.reset;
}

export function black(text: string) {
  return colors.fgBlack + text + colors.reset;
}

const getTime = () => {
  return new Date().toISOString().slice(11, 23);
};

const log = (type: string, color: string, ...message: string[]) => {
  console.log(
    colors.fgGray + `[${getTime()}]` + colors.reset,
    `${color}[${type}${color}]${colors.reset}`, // NOTE: add ${color} after ${type} in case the ${type} also has color
    ...message,
  );
};

const logger: { [key:string]: any } = {
  addType: (type: string, color: string) => {
    logger[type] = (...message: string[]) => {
      log(type, color, ...message);
    };
  },

  addWithSubType: (type: string, color: string) => {
    logger[type] = (subType: string, ...message: string[]) => {
      log(`${type}:${subType}`, color, ...message);
    };
  },

  info: (...message: string[]) => {
    log("info", colors.fgCyan, ...message);
  },

  error: (...message: string[]) => {
    log("error", colors.fgRed, ...message);
  },

  warn: (...message: string[]) => {
    log("warning", colors.fgYellow, ...message);
  },

  success: (...message: string[]) => {
    log("success", colors.fgGreen, ...message);
  },

  debug: (...message: string[]) => {
    log("debug", colors.fgGray, ...message);
  },
};

export default logger;
