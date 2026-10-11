import { handleApi } from "../../../lib/api.mjs";
import { after } from "next/server";
import { dispatchMail } from "../../../lib/mail.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request, context) {
  const { action } = await context.params;
  const response = await handleApi(request, action);
  if (
    response.ok &&
    request.method === "POST" &&
    [
      "recover",
      "person-create",
      "import-people",
      "invite",
      "person-toggle",
    ].includes(action)
  ) {
    after(async () => {
      try {
        await dispatchMail(3);
      } catch {
        console.error("Mail queue remains pending");
      }
    });
  }
  return response;
}
export { handle as GET, handle as POST };
