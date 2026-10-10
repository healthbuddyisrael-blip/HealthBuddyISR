import "server-only";
import { cookies } from "next/headers";

/** Local logout must succeed even when remote session revocation is unavailable. */
export async function clearSessionCookies() {
  const jar = await cookies();
  jar.getAll().forEach(({ name }) => {
    if (/^sb-.*-auth-token(?:-code-verifier)?(?:\.\d+)?$/.test(name))
      jar.delete(name);
  });
}
