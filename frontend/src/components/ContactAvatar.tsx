import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ContactAvatarProps {
  name: string;
  color?: string;
  className?: string;
}

export function ContactAvatar({ name, color = "#6366f1", className }: ContactAvatarProps) {
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Avatar className={className}>
      <AvatarFallback 
        style={{ 
          backgroundColor: color,
          color: "white"
        }}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
