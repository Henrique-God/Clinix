using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UsersAPI.Migrations
{
    /// <inheritdoc />
    public partial class ClinicalRecordsV2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClinicalRecords",
                schema: "users");

            migrationBuilder.CreateTable(
                name: "ClinicalRecordAccessGrants",
                schema: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    GrantedByPatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    StartAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicalRecordAccessGrants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClinicalRecordAccessGrants_Users_DoctorId",
                        column: x => x.DoctorId,
                        principalSchema: "users",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClinicalRecordAccessGrants_Users_PatientId",
                        column: x => x.PatientId,
                        principalSchema: "users",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PatientClinicalRecords",
                schema: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PatientClinicalRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PatientClinicalRecords_Users_PatientId",
                        column: x => x.PatientId,
                        principalSchema: "users",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClinicalRecordEntries",
                schema: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicalRecordId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorType = table.Column<int>(type: "integer", nullable: false),
                    EntryType = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    AppointmentOccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsVisibleToPatient = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicalRecordEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClinicalRecordEntries_PatientClinicalRecords_ClinicalRecord~",
                        column: x => x.ClinicalRecordId,
                        principalSchema: "users",
                        principalTable: "PatientClinicalRecords",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClinicalDocuments",
                schema: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicalRecordEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    StoredFileName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    SizeInBytes = table.Column<long>(type: "bigint", nullable: false),
                    S3Key = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    UploadedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicalDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClinicalDocuments_ClinicalRecordEntries_ClinicalRecordEntry~",
                        column: x => x.ClinicalRecordEntryId,
                        principalSchema: "users",
                        principalTable: "ClinicalRecordEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalDocuments_ClinicalRecordEntryId_CreatedAt",
                schema: "users",
                table: "ClinicalDocuments",
                columns: new[] { "ClinicalRecordEntryId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalRecordAccessGrants_DoctorId",
                schema: "users",
                table: "ClinicalRecordAccessGrants",
                column: "DoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalRecordAccessGrants_PatientId_DoctorId_Status",
                schema: "users",
                table: "ClinicalRecordAccessGrants",
                columns: new[] { "PatientId", "DoctorId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalRecordEntries_AppointmentId",
                schema: "users",
                table: "ClinicalRecordEntries",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalRecordEntries_ClinicalRecordId",
                schema: "users",
                table: "ClinicalRecordEntries",
                column: "ClinicalRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalRecordEntries_PatientId_CreatedAt",
                schema: "users",
                table: "ClinicalRecordEntries",
                columns: new[] { "PatientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PatientClinicalRecords_PatientId",
                schema: "users",
                table: "PatientClinicalRecords",
                column: "PatientId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClinicalDocuments",
                schema: "users");

            migrationBuilder.DropTable(
                name: "ClinicalRecordAccessGrants",
                schema: "users");

            migrationBuilder.DropTable(
                name: "ClinicalRecordEntries",
                schema: "users");

            migrationBuilder.DropTable(
                name: "PatientClinicalRecords",
                schema: "users");

            migrationBuilder.CreateTable(
                name: "ClinicalRecords",
                schema: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfessionalId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicalRecords", x => x.Id);
                });
        }
    }
}
