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
     *
     * Side note:
     *  Also, I'm running the following query using the transactional entity manager in order to avoid inconsistencies.
     *  The queries in addShowTimes and updateShowtimeSummary should be run in the same transaction.
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
  }

  async addShowtimes(showtimes: ShowtimeInterface[]) {
    /**
     * All the queries have to run in a transaction to maintain data integrity
     * and I am updating the resource any time a duplicate showtimeId arrives as we always want to
     * operate with the most recent data.
     *
     * However, when I update the resource, it will invalidate some records in the showtime-summary table.
     * For example, if I update cinema name of a resource, a record in showtime-summary table might have invalid
     * showtime count as the updated record will no longer belong to that group. To avoid these problems, I'll first
     * remove the contents of the showtime-summary table and then repopulate it with the updated data.
     *
     * Side note:
     *  If we dont need the overhead of deleting and repopulating the showtime-summary table, we can simply skip
     *  the conflicting rows and take no action, or even abort the transaction. However, since I think losing the
     *  scraped data isn't what we want, I'll go with this approach.
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
      }

      await em
        .createQueryBuilder()
        .delete()
        .from(ShowtimeSummaryEntity)
        .execute();

      await this.updateShowtimeSummary(em);
    });
  }
}
