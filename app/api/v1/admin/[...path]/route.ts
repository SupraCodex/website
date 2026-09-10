import { handleAdminApi } from "@/lib/api/admin/router";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return handleAdminApi(req);
}

export async function POST(req: Request): Promise<Response> {
  return handleAdminApi(req);
}

export async function PATCH(req: Request): Promise<Response> {
  return handleAdminApi(req);
}

export async function DELETE(req: Request): Promise<Response> {
  return handleAdminApi(req);
}

export async function PUT(req: Request): Promise<Response> {
  return handleAdminApi(req);
}

export async function OPTIONS(req: Request): Promise<Response> {
  return handleAdminApi(req);
}

export async function HEAD(req: Request): Promise<Response> {
  return handleAdminApi(req);
}
