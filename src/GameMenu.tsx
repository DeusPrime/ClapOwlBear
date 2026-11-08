import { Link } from "react-router-dom";
export default function GameMenu(_props: { value: string; onChange: (id: string) => void }) {
  return <Link to="/app/salle" className="p-2 text-sm underline">? CLAP!</Link>;
}
