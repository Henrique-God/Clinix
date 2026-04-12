using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointmentsAPI.Migrations
{
    public partial class BidirectionalAppointmentInvitations : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "InvitedByDoctorId",
                schema: "appointments",
                table: "appointment_invitation_metadata",
                newName: "InvitedByUserId");

            migrationBuilder.RenameColumn(
                name: "PatientResponseNote",
                schema: "appointments",
                table: "appointment_invitation_metadata",
                newName: "ResponseNote");

            migrationBuilder.AddColumn<int>(
                name: "InvitedByRole",
                schema: "appointments",
                table: "appointment_invitation_metadata",
                type: "integer",
                nullable: false,
                defaultValue: 2);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InvitedByRole",
                schema: "appointments",
                table: "appointment_invitation_metadata");

            migrationBuilder.RenameColumn(
                name: "InvitedByUserId",
                schema: "appointments",
                table: "appointment_invitation_metadata",
                newName: "InvitedByDoctorId");

            migrationBuilder.RenameColumn(
                name: "ResponseNote",
                schema: "appointments",
                table: "appointment_invitation_metadata",
                newName: "PatientResponseNote");
        }
    }
}
