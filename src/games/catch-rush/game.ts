import type { GameFactory } from "../core/types";
import { CatcherGame } from "./catcher";

const factory: GameFactory = (def) => new CatcherGame(def, "touch");
export default factory;
