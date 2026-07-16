export function getPositionClass(position?: string) {
  switch (position) {
    case "QB":
      return "border-red-400 bg-red-500/35";

    case "RB":
      return "border-green-400 bg-green-500/35";

    case "WR":
      return "border-blue-400 bg-blue-500/35";

    case "TE":
      return "border-pink-400 bg-pink-500/35";

    case "K":
      return "border-yellow-400 bg-yellow-400/35";

    default:
      return "border-white/10 bg-white/[0.04]";
  }
}