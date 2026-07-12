import { cookies } from "next/headers";
import { OPERATOR_COOKIE, OPERATOR_COOKIE_MAX_AGE } from "@/lib/operators/constants";

export async function getOperatorIdFromCookie() {
  const store = await cookies();
  const value = store.get(OPERATOR_COOKIE)?.value;
  if (!value || !/^[0-9a-f-]{36}$/i.test(value)) {
    return null;
  }
  return value;
}

export async function setOperatorCookie(operatorId: string) {
  const store = await cookies();
  store.set(OPERATOR_COOKIE, operatorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OPERATOR_COOKIE_MAX_AGE,
  });
}

export async function clearOperatorCookie() {
  const store = await cookies();
  store.delete(OPERATOR_COOKIE);
}
