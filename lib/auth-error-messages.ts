export function getAuthErrorMessageInSpanish(error: unknown): string {
  const rawMessage =
    error instanceof Error ? error.message : "Ocurrio un error inesperado.";
  const message = rawMessage.toLowerCase();

  if (message.includes("password should be at least 6 characters")) {
    return "La contrasena debe tener al menos 6 caracteres.";
  }
  if (message.includes("invalid login credentials")) {
    return "Correo o contrasena incorrectos.";
  }
  if (message.includes("email not confirmed")) {
    return "Debes confirmar tu correo antes de iniciar sesion.";
  }
  if (message.includes("user already registered")) {
    return "Este correo ya esta registrado.";
  }
  if (message.includes("unable to validate email address")) {
    return "El correo no es valido.";
  }
  if (message.includes("signup is disabled")) {
    return "El registro esta deshabilitado temporalmente.";
  }
  if (message.includes("too many requests")) {
    return "Demasiados intentos. Intenta de nuevo en unos minutos.";
  }
  if (message.includes("same password")) {
    return "La nueva contrasena debe ser distinta a la actual.";
  }
  if (message.includes("token has expired") || message.includes("expired")) {
    return "El enlace expiro. Solicita uno nuevo.";
  }
  if (message.includes("otp") && message.includes("invalid")) {
    return "El enlace no es valido. Solicita uno nuevo.";
  }

  return rawMessage;
}
