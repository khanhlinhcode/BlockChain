import "@testing-library/jest-dom";
import { webcrypto } from "node:crypto";
import { TextDecoder, TextEncoder } from "node:util";

Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});

Object.defineProperty(globalThis, "TextEncoder", {
  value: TextEncoder,
  configurable: true,
});

Object.defineProperty(globalThis, "TextDecoder", {
  value: TextDecoder,
  configurable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

window.scrollTo = jest.fn();
window.open = jest.fn();
