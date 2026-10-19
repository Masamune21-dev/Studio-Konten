import { AbsoluteFill } from "remotion";
import { Character } from "./components/Character";
import { K } from "./design";

// Character sheet for reviewing designs and poses.
export const Sheet: React.FC = () => (
  <AbsoluteFill style={{ background: K.cream, flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start", padding: 30, gap: 10 }}>
    <Character who="tech" mood="happy" pose="wave" width={330} />
    <Character who="cs" mood="happy" pose="headset" width={330} />
    <Character who="user" mood="sad" pose="phone" width={330} />
    <Character who="tech" mood="excited" pose="thumbs" talk={0.7} width={330} />
    <Character who="cs" mood="neutral" pose="point" talk={0.4} width={330} />
    <Character who="user" mood="excited" pose="cheer" width={330} />
  </AbsoluteFill>
);
