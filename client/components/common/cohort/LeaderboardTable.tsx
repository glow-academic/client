/**
 * LeaderboardTable.tsx
 * This component renders the performance data in a ranked table
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface LeaderboardData {
  id: string;
  name: string;
  avgScore: number;
  passRate: number;
  simsCompleted: number;
  role?: string;
}

export interface LeaderboardTableProps {
  data: LeaderboardData[];
  currentUserId: string;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

export default function LeaderboardTable({
  data,
  currentUserId,
}: LeaderboardTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">No users found in this cohort.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Rank</TableHead>
            <TableHead>User</TableHead>
            <TableHead className="text-right">Role</TableHead>
            <TableHead className="text-right">Avg. Score</TableHead>
            <TableHead className="text-right">Pass Rate</TableHead>
            <TableHead className="text-right">Sims Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((user, index) => (
            <TableRow
              key={user.id}
              className={user.id === currentUserId ? "bg-muted/50" : ""}
            >
              <TableCell className="font-bold text-lg">{index + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar
                    className="h-9 w-9 outline outline-muted-foreground"
                    style={{ outlineWidth: "1px", outlineStyle: "solid" }}
                  >
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{user.name}</span>
                  {user.id === currentUserId && (
                    <Badge variant="default">You</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="outline" className="text-xs">
                  {user.role || "Unknown"}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-semibold">
                {user.avgScore}%
              </TableCell>
              <TableCell className="text-right">{user.passRate}%</TableCell>
              <TableCell className="text-right">{user.simsCompleted}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
