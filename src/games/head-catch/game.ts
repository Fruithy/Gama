import type { GameFactory } from "../core/types";
import { CatcherGame } from "../catch-rush/catcher";

const factory: GameFactory = (def) => new CatcherGame(def, "head");
export default factory;
