import type { BuiltinCommandHandler } from "./index";

export const coinFlip: BuiltinCommandHandler = {
  id: "coin.flip",
  description: "Flip a coin and reply with heads or tails.",
  async handle() {
    const result = Math.random() < 0.5 ? "앞면" : "뒷면";
    return { content: `🪙 ${result}` };
  },
};
