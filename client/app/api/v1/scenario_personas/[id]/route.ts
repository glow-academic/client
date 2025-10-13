// Composite/no PK table – implement custom id semantics if needed
export async function GET() {
  return Response.json(
    { error: "Not supported for composite/no primary key tables" },
    { status: 400 },
  );
}
export async function PATCH() {
  return Response.json({ error: "Not supported" }, { status: 400 });
}
export async function DELETE() {
  return Response.json({ error: "Not supported" }, { status: 400 });
}
