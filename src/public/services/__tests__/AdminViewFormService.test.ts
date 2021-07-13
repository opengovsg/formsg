import MockAxios from 'jest-mock-axios'

import { IPopulatedForm, PublicForm, ResponseMode } from 'src/types/form'

import {
  AdminDashboardFormMetaDto,
  FormStatus,
} from '../../../../shared/types/form/form'
import { UserDto } from '../../../../shared/types/user'
import {
  ADMIN_FORM_ENDPOINT,
  getAdminFormView,
  getDashboardView,
  previewForm,
} from '../AdminViewFormService'

jest.mock('axios', () => MockAxios)

const MOCK_USER = {
  _id: 'mock-user-id',
} as UserDto

describe('AdminViewFormService', () => {
  afterEach(() => MockAxios.reset())
  describe('getDashboardView', () => {
    it('should successfully return all available forms if GET request succeeds', async () => {
      // Arrange
      const expected: AdminDashboardFormMetaDto[] = [
        {
          title: 'title',
          lastModified: new Date(),
          _id: 'mock-form-id',
          responseMode: ResponseMode.Email,
          admin: MOCK_USER,
          status: FormStatus.Private,
        },
      ]
      MockAxios.get.mockResolvedValueOnce({ data: expected })
      // Act
      const actual = await getDashboardView()

      // Assert
      expect(actual).toEqual(expected)
      expect(MockAxios.get).toHaveBeenCalledWith(`${ADMIN_FORM_ENDPOINT}`)
    })

    it('should successfully return empty array if GET request succeeds and there are no forms', async () => {
      // Arrange
      const expected: AdminDashboardFormMetaDto[] = []
      MockAxios.get.mockResolvedValueOnce({ data: expected })

      // Act
      const actual = await getDashboardView()

      // Assert
      expect(actual).toEqual(expected)
      expect(MockAxios.get).toHaveBeenCalledWith(`${ADMIN_FORM_ENDPOINT}`)
    })

    it('should reject with error message if GET request fails', async () => {
      // Arrange
      const expected = new Error('error')
      MockAxios.get.mockRejectedValueOnce(expected)

      // Act
      const actualPromise = getDashboardView()

      //Assert
      await expect(actualPromise).rejects.toEqual(expected)
      expect(MockAxios.get).toHaveBeenCalledWith(`${ADMIN_FORM_ENDPOINT}`)
    })
  })

  describe('getAdminFormView', () => {
    it('should return admin form if GET request succeeds', async () => {
      // Arrange
      const expected = _generateMockFullForm()
      MockAxios.get.mockResolvedValueOnce({ data: expected })

      // Act
      const actual = await getAdminFormView(expected._id)

      // Assert
      expect(actual).toEqual(expected)
      expect(MockAxios.get).toHaveBeenCalledWith(
        `${ADMIN_FORM_ENDPOINT}/${expected._id}`,
      )
    })

    it('should reject with error message when GET request fails', async () => {
      // Arrange
      const expected = new Error('error')
      const MOCK_FORM = _generateMockFullForm()
      MockAxios.get.mockRejectedValueOnce(expected)

      // Act
      const actualPromise = getAdminFormView(MOCK_FORM._id)

      // Assert
      await expect(actualPromise).rejects.toEqual(expected)
      expect(MockAxios.get).toHaveBeenCalledWith(
        `${ADMIN_FORM_ENDPOINT}/${MOCK_FORM._id}`,
      )
    })
  })

  describe('previewForm', () => {
    it('should return public form if GET request succeeds', async () => {
      // Arrange
      const MOCK_FORM_ID = 'mock-form-id'
      const expected = {
        _id: MOCK_FORM_ID,
        title: 'mock preview title',
        admin: MOCK_USER,
      } as unknown as PublicForm
      MockAxios.get.mockResolvedValueOnce({ data: expected })

      // Act
      const actual = await previewForm(MOCK_FORM_ID)

      // Assert
      expect(actual).toEqual(expected)
      expect(MockAxios.get).toHaveBeenCalledWith(
        `${ADMIN_FORM_ENDPOINT}/${MOCK_FORM_ID}/preview`,
      )
    })

    it('should reject with error message if GET request fails', async () => {
      // Arrange
      const expected = new Error('error')
      const MOCK_FORM_ID = 'mock-form-id'
      MockAxios.get.mockRejectedValueOnce(expected)

      // Act
      const actualPromise = previewForm(MOCK_FORM_ID)

      // Assert
      await expect(actualPromise).rejects.toEqual(expected)
      expect(MockAxios.get).toHaveBeenCalledWith(
        `${ADMIN_FORM_ENDPOINT}/${MOCK_FORM_ID}/preview`,
      )
    })
  })
})

// Utils
const _generateMockFullForm = (): IPopulatedForm => {
  return {
    _id: 'mock-form-id',
  } as IPopulatedForm
}
