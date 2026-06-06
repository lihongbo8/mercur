import type { DijieAccountAccessProfileReader } from "./account-access-store";
import {
  createDijieAccessContext,
  type DijieAccessContext,
  type DijieAccessProfile,
} from "./data-permissions";

export async function resolveDijieAccessContext(input: {
  authContext: unknown;
  profileReader?: DijieAccountAccessProfileReader;
}): Promise<DijieAccessContext | null> {
  const base = createDijieAccessContext(input.authContext);
  if (!base || !input.profileReader) {
    return base;
  }

  try {
    const profile = await input.profileReader.retrieveDijieAccountAccessProfile({
      accountId: base.accountId,
    });
    return createDijieAccessContext(input.authContext, profile as DijieAccessProfile | undefined);
  } catch {
    return base;
  }
}
