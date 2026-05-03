import { NextRequest, NextResponse } from "next/server";

import { applyRefreshCookie, postToCoreAuth } from "@/features/auth/server/route-utils";
import type { AuthTokenResponse } from "@/features/auth/types";

export async function POST(request: NextRequest) {
  const refreshCookie = request.cookies.get("refresh")?.value;
  const { result, setCookieHeader } = await postToCoreAuth<AuthTokenResponse>(
    "refresh-token/",
    {
      refreshCookie,
    },
  );

  const response = NextResponse.json(result);
  applyRefreshCookie(response, setCookieHeader);

  return response;
}
