import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getUser } from "@/utils/queries/get-user";
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Rubric from "@/components/Rubric"
import { logout } from "@/utils/mutations/logout"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function UserNav() {
  const [showRubric, setShowRubric] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  
  const {data: user} = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser()
  });
  
  // Function to generate initials
  const getInitials = (name?: string) => {
    if (!name) return '';
    
    if (name.includes(' ')) {
      // If name has space, get first char of first and last name
      const nameParts = name.split(' ');
      return (nameParts[0].charAt(0) + nameParts[nameParts.length-1].charAt(0)).toUpperCase();
    } else {
      // Otherwise get first two chars of name
      return name.substring(0, 2).toUpperCase();
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    toast.promise(
      async () => {
        try {
          const { success, error } = await logout();
          if (success) {
            router.push('/');
            return "Logged out successfully";
          } else {
            throw new Error(error);
          }
        } catch (error) {
          console.error('Error logging out:', error);
          throw new Error(typeof error === 'string' ? error : 'Failed to log out');
        } finally {
          setIsLoggingOut(false);
        }
      },
      {
        loading: 'Logging out...',
        success: (message) => message,
        error: (error) => error.message || 'Failed to log out'
      }
    );
  }
  
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user?.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.username}@purdue.edu
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setShowRubric(true)}>
              Rubric
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuItem 
            onClick={handleLogout} 
            disabled={isLoggingOut} 
            className={isLoggingOut ? "opacity-70 cursor-not-allowed" : ""}
          >
            {isLoggingOut ? "Logging out..." : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Dialog open={showRubric} onOpenChange={setShowRubric}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Rubric</DialogTitle>
          </DialogHeader>
          <Rubric />
        </DialogContent>
      </Dialog>
    </>
  )
}
