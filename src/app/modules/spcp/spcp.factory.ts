import { err, Result } from 'neverthrow'

import FeatureManager, {
  FeatureNames,
  RegisteredFeature,
} from '../../../config/feature-manager'
import { AuthType } from '../../../types'
import { MissingFeatureError } from '../core/core.errors'

import { CreateRedirectUrlError } from './spcp.errors'
import { SpcpService } from './spcp.service'

interface ISpcpFactory {
  createRedirectUrl(
    authType: AuthType,
    target: string,
    eSrvcId: string,
  ): Result<string, CreateRedirectUrlError | MissingFeatureError>
}

export const createSpcpFactory = ({
  isEnabled,
  props,
}: RegisteredFeature<FeatureNames.SpcpMyInfo>): ISpcpFactory => {
  if (!isEnabled || !props) {
    const error = new MissingFeatureError(FeatureNames.SpcpMyInfo)
    return {
      createRedirectUrl: () => err(error),
    }
  }
  return new SpcpService(props)
}

const spcpFeature = FeatureManager.get(FeatureNames.SpcpMyInfo)
export const SpcpFactory = createSpcpFactory(spcpFeature)
