using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UsersAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddDoctorProfilesAndSegmentedAuth : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DoctorProfiles",
                schema: "users",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfessionalRegister = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    NormalizedProfessionalRegister = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Specialties = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Phone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DoctorProfiles", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_DoctorProfiles_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "users",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DoctorProfiles_NormalizedProfessionalRegister",
                schema: "users",
                table: "DoctorProfiles",
                column: "NormalizedProfessionalRegister",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DoctorProfiles",
                schema: "users");
        }
    }
}
