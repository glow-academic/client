export async function getCsvStudents(classId?: string) {
  const url = classId 
    ? `${process.env.NEXT_PUBLIC_API_URL}/csv-students?classId=${classId}`
    : `${process.env.NEXT_PUBLIC_API_URL}/csv-students`;
    
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSV students: ${response.statusText}`);
  }

  return response.json();
}
