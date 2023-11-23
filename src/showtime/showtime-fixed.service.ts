import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ShowtimeEntity } from './entity/showtime.entity';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ShowtimeSummaryEntity } from './entity/showtimeSummary.entity';

@Injectable()
export class ShowtimeService {
  constructor(
    @InjectRepository(ShowtimeEntity)
    private showtimeEntityRepository: Repository<ShowtimeEntity>,
    @InjectRepository(ShowtimeSummaryEntity)
    private showtimeSummaryEntityRepository: Repository<ShowtimeSummaryEntity>,
    private dataSource: DataSource
  ) {}

  private async updateShowtimeSummary(em: EntityManager) {
    /**
     * A relevant index is already added on columns "showtimeInUTC", "cinemaName", "movieTitle", "attributes", "city" on the "showtime" table
     * to speed up the select query. In order to avoid redundancy, I created a one to one relation by adding a foreign key
     * to showtime-summary table and I associate the current reporting information (showtimeCount) with the id column of
     * first record in each aggregated group. That way I dont have to duplicate the columns and using the relation, I can
     * get the relevant information like "showtimeInUTC", "cinemaName", "movieTitle", "attributes", "city" for each report
     * using a simple join query. Please see the entities to understand more about the relation.
     */
    await em.query(`
        INSERT INTO "showtime-summary"
        (
            "showtimeId",
            "showtimeCount"
        )
        select 
            min(showtime."id"),
            count(*)
        from "showtime"
        group by "showtimeInUTC", "cinemaName", "movieTitle", "attributes", "city"
        ON CONFLICT
        (
            "showtimeId"
        )
        DO UPDATE
           SET "showtimeCount"= EXCLUDED."showtimeCount"
    `);
    // TODO: Investigate and resolve the duplication issue in the "showtime-summary" table.
    // If you check the "showtime-summary" table rows you will notice that there duplicate rows.
    // Analyze the current aggregation query to identify why duplicates are being created.
    // Modify the query or the table structure as necessary to prevent duplicate entries.
    // Ensure your solution maintains data integrity and optimizes performance.
  }

  async addShowtimes(showtimes: ShowtimeInterface[]) {
    /**
     * All the queries have to run in a transaction to maintain data integrity
     * and I am updating the resource any time a duplicate showtimeId arrives as we always want to
     * operate with the most recent data.
     *
     * However, when I update the resource, some records in showtime-summary table will be invalid.
     * In order to clean up those invalid records, I have created a trigger which can be found in
     * src/migrations/1700744414056-SummaryCleanupTrigger.ts. The trigger removes all the reports
     * whose id is pointing at the updated record.
     */
    this.dataSource.transaction(async (em: EntityManager) => {
      for (const showtime of showtimes) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(ShowtimeEntity)
          .values({
            showtimeId: showtime.showtimeId,
            movieTitle: showtime.movieTitle,
            cinemaName: showtime.cinemaName,
            showtimeInUTC: showtime.showtimeInUTC,
            bookingLink: showtime.bookingLink,
            attributes: showtime.attributes,
          })
          .orUpdate(
            [
              'movieTitle',
              'cinemaName',
              'showtimeInUTC',
              'bookingLink',
              'attributes',
            ],
            ['showtimeId']
          )
          .execute();

        // TODO: Implement error handling for cases where a duplicate 'showtimeId' is used during insertion.
        // Consider how the application should behave in this scenario (e.g., skip, replace, or abort the operation).
        // Implement the necessary logic and provide feedback or logging for the operation outcome.
        // Ensure your solution handles such conflicts gracefully without causing data inconsistency or application failure.
      }
      await this.updateShowtimeSummary(em);
    });
  }
}
