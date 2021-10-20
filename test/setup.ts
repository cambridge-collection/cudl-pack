// Occasionally tests hit the 5 second default timeout, so increase it a bit.
// If the JEST_TIMEOUT envar is set, use that as the timeout.
jest.setTimeout(
    Number.parseInt(process.env.JEST_TIMEOUT || "", 10) || 1000 * 10
);
