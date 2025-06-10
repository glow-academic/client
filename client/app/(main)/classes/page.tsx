/**
 * app/(main)/classes/page.tsx
 * Classes page. Redirects to new class page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

// import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
// import { useQuery } from "@tanstack/react-query";
import { redirect } from "next/navigation";

export default function ClassesPage() {
  // const { data: classes } = useQuery({
  //   queryKey: ["classes"],
  //   queryFn: () => getAllClasses(),
  // });
  // // get the id of the first class
  // const firstClassId = classes?.[0]?.id;
  // return redirect(`/classes/c/${firstClassId}`);
  return redirect("/home");
}
