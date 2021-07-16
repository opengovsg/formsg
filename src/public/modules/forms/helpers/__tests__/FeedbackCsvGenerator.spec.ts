import { ObjectId } from 'bson'
import moment from 'moment-timezone'

import { FormFeedbackDto } from '../../../../../../shared/types/form/form_feedback'
import { DateString } from '../../../../../../shared/types/generic'
import { FeedbackCsvGenerator } from '../FeedbackCsvGenerator'

describe('FeedbackCsvGenerator', () => {
  describe('setHeader', () => {
    it('should set headers correctly', () => {
      // Arrange
      const feedbackCsv = new FeedbackCsvGenerator(1)

      // Assert
      expect(feedbackCsv.records[1]).toEqual(
        expect.stringContaining('Date,Comment,Rating'),
      )
    })
  })

  describe('addLineFromFeedback', () => {
    it('should add line successfully if created and lastmodified dates are provided', () => {
      // Arrange
      const feedbackCsv = new FeedbackCsvGenerator(1)
      const feedback: FormFeedbackDto = {
        rating: 3,
        comment: 'some comment',
        formId: new ObjectId().toHexString(),
        created: new Date('2019-11-05T13:12:14').toISOString() as DateString,
        lastModified: new Date(
          '2019-11-05T13:12:14',
        ).toISOString() as DateString,
      }
      const insertedCreatedDate = moment(feedback.created)
        .tz('Asia/Singapore')
        .format('DD MMM YYYY hh:mm:ss A')

      const insertedLine = `${insertedCreatedDate},${feedback.comment},${feedback.rating}`

      // Act
      feedbackCsv.addLineFromFeedback(feedback)

      //Assert
      expect(feedbackCsv.idx).toEqual(3)
      expect(feedbackCsv.records[2]).toEqual(
        expect.stringContaining(insertedLine),
      )
    })

    it('should add line successfully if comment, created and lastmodified dates are not provided', () => {
      // Arrange
      const feedbackCsv = new FeedbackCsvGenerator(1)
      const feedback: FormFeedbackDto = {
        rating: 3,
        formId: new ObjectId().toHexString(),
      }
      const todaysDate = moment().tz('Asia/Singapore').format('DD MMM YYYY')

      // Act
      feedbackCsv.addLineFromFeedback(feedback)

      //Assert
      expect(feedbackCsv.idx).toEqual(3)
      expect(feedbackCsv.records[2]).toEqual(
        expect.stringContaining(todaysDate),
      )
    })
  })
})
