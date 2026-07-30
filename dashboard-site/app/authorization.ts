import { getChatGPTUser, requireChatGPTUser } from "./chatgpt-auth";

export function isAllowedEmail(actual: string, allowed?: string) {
  return Boolean(
    allowed && actual.trim().toLowerCase() === allowed.trim().toLowerCase(),
  );
}

export async function requireAllowedUser(returnTo: string) {
  await requireChatGPTUser(returnTo);
  const user = await getChatGPTUser();
  if (!user || !isAllowedEmail(user.email, process.env.ALLOWED_USER_EMAIL)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
