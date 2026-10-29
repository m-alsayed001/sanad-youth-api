import { UserRole } from "../../common/Enums/index.js";

export class currentUserDto {
    userId: number;
    email: string;
    role: UserRole;
}
