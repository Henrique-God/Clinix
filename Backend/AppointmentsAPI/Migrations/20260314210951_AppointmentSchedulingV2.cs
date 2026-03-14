using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointmentsAPI.Migrations
{
    /// <inheritdoc />
    public partial class AppointmentSchedulingV2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_Appointments",
                schema: "appointments",
                table: "Appointments");

            migrationBuilder.RenameTable(
                name: "Appointments",
                schema: "appointments",
                newName: "appointments",
                newSchema: "appointments");

            migrationBuilder.RenameColumn(
                name: "ProfessionalId",
                schema: "appointments",
                table: "appointments",
                newName: "DoctorId");

            migrationBuilder.AddColumn<DateTime>(
                name: "AcceptedAt",
                schema: "appointments",
                table: "appointments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                schema: "appointments",
                table: "appointments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                schema: "appointments",
                table: "appointments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: "appointments",
                table: "appointments",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "InvitationExpiresAt",
                schema: "appointments",
                table: "appointments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Location",
                schema: "appointments",
                table: "appointments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedAt",
                schema: "appointments",
                table: "appointments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Title",
                schema: "appointments",
                table: "appointments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                schema: "appointments",
                table: "appointments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddPrimaryKey(
                name: "PK_appointments",
                schema: "appointments",
                table: "appointments",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "agenda_events",
                schema: "appointments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    StartTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BlocksScheduling = table.Column<bool>(type: "boolean", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_agenda_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_agenda_events_appointments_AppointmentId",
                        column: x => x.AppointmentId,
                        principalSchema: "appointments",
                        principalTable: "appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "appointment_invitation_metadata",
                schema: "appointments",
                columns: table => new
                {
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvitedByDoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvitationMessage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    PatientResponseNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_appointment_invitation_metadata", x => x.AppointmentId);
                    table.ForeignKey(
                        name: "FK_appointment_invitation_metadata_appointments_AppointmentId",
                        column: x => x.AppointmentId,
                        principalSchema: "appointments",
                        principalTable: "appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "appointment_status_history",
                schema: "appointments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromStatus = table.Column<int>(type: "integer", nullable: true),
                    ToStatus = table.Column<int>(type: "integer", nullable: false),
                    ChangedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_appointment_status_history", x => x.Id);
                    table.ForeignKey(
                        name: "FK_appointment_status_history_appointments_AppointmentId",
                        column: x => x.AppointmentId,
                        principalSchema: "appointments",
                        principalTable: "appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "doctor_availability",
                schema: "appointments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Visibility = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_doctor_availability", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_DoctorId_StartTime",
                schema: "appointments",
                table: "appointments",
                columns: new[] { "DoctorId", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_DoctorId_Status_StartTime",
                schema: "appointments",
                table: "appointments",
                columns: new[] { "DoctorId", "Status", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_PatientId_StartTime",
                schema: "appointments",
                table: "appointments",
                columns: new[] { "PatientId", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_agenda_events_AppointmentId",
                schema: "appointments",
                table: "agenda_events",
                column: "AppointmentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_agenda_events_DoctorId_StartTime_EndTime",
                schema: "appointments",
                table: "agenda_events",
                columns: new[] { "DoctorId", "StartTime", "EndTime" });

            migrationBuilder.CreateIndex(
                name: "IX_appointment_status_history_AppointmentId_ChangedAt",
                schema: "appointments",
                table: "appointment_status_history",
                columns: new[] { "AppointmentId", "ChangedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_doctor_availability_DoctorId_StartTime_EndTime",
                schema: "appointments",
                table: "doctor_availability",
                columns: new[] { "DoctorId", "StartTime", "EndTime" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "agenda_events",
                schema: "appointments");

            migrationBuilder.DropTable(
                name: "appointment_invitation_metadata",
                schema: "appointments");

            migrationBuilder.DropTable(
                name: "appointment_status_history",
                schema: "appointments");

            migrationBuilder.DropTable(
                name: "doctor_availability",
                schema: "appointments");

            migrationBuilder.DropPrimaryKey(
                name: "PK_appointments",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropIndex(
                name: "IX_appointments_DoctorId_StartTime",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropIndex(
                name: "IX_appointments_DoctorId_Status_StartTime",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropIndex(
                name: "IX_appointments_PatientId_StartTime",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "AcceptedAt",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "Description",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "InvitationExpiresAt",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "Location",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "RejectedAt",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "Title",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                schema: "appointments",
                table: "appointments");

            migrationBuilder.RenameTable(
                name: "appointments",
                schema: "appointments",
                newName: "Appointments",
                newSchema: "appointments");

            migrationBuilder.RenameColumn(
                name: "DoctorId",
                schema: "appointments",
                table: "Appointments",
                newName: "ProfessionalId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Appointments",
                schema: "appointments",
                table: "Appointments",
                column: "Id");
        }
    }
}
