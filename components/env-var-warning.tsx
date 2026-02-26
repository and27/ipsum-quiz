import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function EnvVarWarning() {
  return (
    <div className="flex gap-4 items-center">
      <Badge variant={"outline"} className="font-normal">
        Se requieren variables de entorno de Supabase
      </Badge>
      <div className="flex gap-2">
        <Button size="sm" variant={"outline"} disabled>
          Iniciar sesion
        </Button>
        <Button size="sm" variant={"default"} disabled>
          Registrarse
        </Button>
      </div>
    </div>
  );
}
