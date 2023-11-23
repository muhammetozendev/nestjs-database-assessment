import { MigrationInterface, QueryRunner } from 'typeorm';

export class SummaryCleanupTrigger1700744414056 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /*
        Create a trigger that deletes the corresponding summary reports
        for the updated showtime records. This is because when the record is
        updated, the summary report is no longer valid and therefore has to be recalculated.
    */
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION cleanup_reports()
            RETURNS TRIGGER AS $$
            BEGIN
                DELETE FROM "showtime-summary" WHERE "showtimeId" = OLD."id";
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

    await queryRunner.query(`
            CREATE TRIGGER cleanup_reports_trigger
            BEFORE UPDATE ON showtime
            FOR EACH ROW
            EXECUTE FUNCTION cleanup_reports();
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS cleanup_reports_trigger ON showtime;
        `);

    await queryRunner.query(`
            DROP FUNCTION IF EXISTS cleanup_reports();
        `);
  }
}
