using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UsersAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddStravaIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StravaConnections",
                schema: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    StravaAthleteId = table.Column<long>(type: "bigint", nullable: false),
                    AccessToken = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    RefreshToken = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    TokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Scope = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ConnectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StravaConnections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StravaConnections_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "users",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StravaActivities",
                schema: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StravaConnectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    StravaActivityId = table.Column<long>(type: "bigint", nullable: false),
                    Name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DistanceMeters = table.Column<double>(type: "double precision", nullable: false),
                    MovingTimeSeconds = table.Column<int>(type: "integer", nullable: false),
                    ElapsedTimeSeconds = table.Column<int>(type: "integer", nullable: false),
                    TotalElevationGain = table.Column<double>(type: "double precision", nullable: false),
                    AverageHeartRate = table.Column<double>(type: "double precision", nullable: true),
                    MaxHeartRate = table.Column<double>(type: "double precision", nullable: true),
                    Calories = table.Column<double>(type: "double precision", nullable: true),
                    SyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StravaActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StravaActivities_StravaConnections_StravaConnectionId",
                        column: x => x.StravaConnectionId,
                        principalSchema: "users",
                        principalTable: "StravaConnections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StravaConnections_UserId",
                schema: "users",
                table: "StravaConnections",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StravaActivities_StravaConnectionId",
                schema: "users",
                table: "StravaActivities",
                column: "StravaConnectionId");

            migrationBuilder.CreateIndex(
                name: "IX_StravaActivities_StravaActivityId",
                schema: "users",
                table: "StravaActivities",
                column: "StravaActivityId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StravaActivities",
                schema: "users");

            migrationBuilder.DropTable(
                name: "StravaConnections",
                schema: "users");
        }
    }
}
