namespace dragonBones {
    /**
     *
     */
    export const enum AnimationFadeOutMode {
        None = 0,
        SameLayer = 1,
        SameGroup = 2,
        SameLayerAndGroup = 3,
        All = 4
    }
    /**
     *
     */
    export interface IAnimateble {
        advanceTime(passedTime: Number): void;
    }
    /**
     *
     */
    export class Animation extends BaseObject {
		/**
		 * @private
		 */
        protected static _sortAnimationState(a: AnimationState, b: AnimationState): number {
            return a.layer > b.layer ? 1 : -1;
        }
		/**
		 * 
		 */
        public timeScale: number;
		/**
		 * @private Armature Slot
		 */
        public _animationStateDirty: boolean;
		/**
		 * @private Armature Slot
		 */
        public _timelineStateDirty: boolean;
		/**
		 * @private Factory
		 */
        public _armature: Armature;
        /**
		 * @private
		 */
        protected _isPlaying: boolean;
        /**
		 * @private
		 */
        protected _time: number;
		/**
		 * @private
		 */
        protected _lastAnimationState: AnimationState;
		/**
		 * @private
		 */
        protected _animations: Map<AnimationData> = {};
		/**
		 * @private
		 */
        protected _animationNames: Array<string> = [];
		/**
		 * @private
		 */
        protected _animationStates: Array<AnimationState> = [];
		/**
		 * @private
		 */
        public constructor() {
            super();
        }
		/**
		 * @inheritDoc
		 */
        protected _onClear(): void {
            this.timeScale = 1;

            this._animationStateDirty = false;
            this._timelineStateDirty = false;
            this._armature = null;

            this._isPlaying = false;
            this._time = 0;
            this._lastAnimationState = null;

            for (let i in this._animations) {
                delete this._animations[i];
            }

            if (this._animationNames.length) {
                this._animationNames.length = 0;
            }

            if (this._animationStates.length) {
                for (let i = 0, l = this._animationStates.length; i < l; ++i) {
                    this._animationStates[i].returnToPool();
                }

                this._animationStates.length = 0;
            }
        }
		/**
		 * @private
		 */
        protected _fadeOut(fadeOutTime: number, layer: number, group: string, fadeOutMode: AnimationFadeOutMode, pauseFadeOut: boolean): void {
            let i = 0, l = this._animationStates.length;
            let animationState: AnimationState = null;

            switch (fadeOutMode) {
                case AnimationFadeOutMode.None:
                    break;

                case AnimationFadeOutMode.SameLayer:
                    for (; i < l; ++i) {
                        animationState = this._animationStates[i];
                        if (animationState.layer == layer) {
                            animationState.fadeOut(fadeOutTime, pauseFadeOut);
                        }
                    }
                    break;

                case AnimationFadeOutMode.SameGroup:
                    for (; i < l; ++i) {
                        animationState = this._animationStates[i];
                        if (animationState.group == group) {
                            animationState.fadeOut(fadeOutTime, pauseFadeOut);
                        }
                    }
                    break;

                case AnimationFadeOutMode.All:
                    for (; i < l; ++i) {
                        animationState = this._animationStates[i];
                        animationState.fadeOut(fadeOutTime, pauseFadeOut);
                    }
                    break;

                case AnimationFadeOutMode.SameLayerAndGroup:
                    for (; i < l; ++i) {
                        animationState = this._animationStates[i];
                        if (animationState.layer == layer && animationState.group == group) {
                            animationState.fadeOut(fadeOutTime, pauseFadeOut);
                        }
                    }
                    break;
            }
        }
		/**
		 * @private
		 */
        public _updateFFDTimelineStates(): void {
            for (let i = 0, l = this._animationStates.length; i < l; ++i) {
                this._animationStates[i]._updateFFDTimelineStates();
            }
        }
		/**
		 * @private
		 */
        public _advanceTime(passedTime: number): void {
            if (!this._isPlaying) {
                return;
            }

            if (passedTime < 0) {
                passedTime = -passedTime;
            }

            const animationStateCount = this._animationStates.length;
            if (animationStateCount == 1) {
                const animationState = this._animationStates[0];
                if (animationState._isFadeOutComplete) {
                    animationState.returnToPool();
                    this._animationStates.length = 0;
                    this._animationStateDirty = true;
                    this._lastAnimationState = null;
                } else {
                    if (this._timelineStateDirty) {
                        animationState._updateTimelineStates();
                    }

                    animationState._advanceTime(passedTime, 1, 0);
                }
            } else if (animationStateCount > 1) {
                let prevLayer = this._animationStates[0]._layer;
                let weightLeft = 1;
                let layerTotalWeight = 0;
                let layerIndex = 1;

                for (let i = 0, r = 0; i < animationStateCount; ++i) {
                    const animationState = this._animationStates[i];
                    if (animationState._isFadeOutComplete) {
                        r++;
                        animationState.returnToPool();

                        if (this._lastAnimationState == animationState) {
                            if (i - r >= 0) {
                                this._lastAnimationState = this._animationStates[i - r];
                            } else {
                                this._lastAnimationState = null;
                            }
                        }
                    } else {
                        if (r > 0) {
                            this._animationStates[i - r] = animationState;
                        }

                        if (prevLayer != animationState._layer) {
                            prevLayer = animationState._layer;

                            if (layerTotalWeight >= weightLeft) {
                                weightLeft = 0;
                            } else {
                                weightLeft -= layerTotalWeight;
                            }

                            layerTotalWeight = 0;
                        }

                        if (this._timelineStateDirty) {
                            animationState._updateTimelineStates();
                        }

                        animationState._advanceTime(passedTime, weightLeft, layerIndex);

                        if (animationState._weightResult) {
                            layerTotalWeight += animationState._weightResult;
                            layerIndex++;
                        }
                    }

                    if (i == animationStateCount - 1 && r > 0) {
                        this._animationStates.length -= r;
                    }
                }
            }

            this._timelineStateDirty = false;
        }

        public reset(): void {
            this._isPlaying = false;
            this._lastAnimationState = null;

            for (let i = 0, l = this._animationStates.length; i < l; ++i) {
                this._animationStates[i].returnToPool();
            }

            this._animationStates.length = 0;
        }

        public play(animationName: string = null, playTimes: number = -1): AnimationState {
            let animationState: AnimationState = null;
            if (animationName) {
                animationState = this.fadeIn(animationName, 0, playTimes, 0, null, AnimationFadeOutMode.All);
            } else if (!this._lastAnimationState) {
                const defaultAnimation = this._armature.armatureData.defaultAnimation;
                if (defaultAnimation) {
                    animationState = this.fadeIn(defaultAnimation.name, 0, -1, 0, null, AnimationFadeOutMode.All);
                }
            } else if (!this._isPlaying) {
                this._isPlaying = true;
            } else {
                animationState = this.fadeIn(this._lastAnimationState.name, 0, -1, 0, null, AnimationFadeOutMode.All);
            }

            return animationState;
        }

        public stop(animationName: string = null): void {
            if (animationName) {
                const animationState = this.getState(animationName);
                if (animationState) {
                    animationState.stop();
                }
            } else {
                this._isPlaying = false;
            }
        }

        public fadeIn(
            animationName: string, fadeInTime: number = -1, playTimes: number = -1,
            layer: number = 0, group: string = null, fadeOutMode: AnimationFadeOutMode = AnimationFadeOutMode.SameLayerAndGroup,
            additiveBlending: boolean = false, displayControl: boolean = true,
            pauseFadeOut: boolean = true, pauseFadeIn: boolean = true
        ): AnimationState {
            const clipData = this._animations[animationName];
            if (!clipData) {
                this._time = 0;
                console.warn("No animation.", " Armature: " + this._armature.name, " Animation: " + animationName);
                return null;
            }

            this._isPlaying = true;

            if (fadeInTime != fadeInTime || fadeInTime < 0) {
                if (this._lastAnimationState) {
                    fadeInTime = clipData.fadeInTime;
                } else {
                    fadeInTime = 0;
                }
            }

            if (playTimes < 0) {
                playTimes = clipData.playTimes;
            }

            this._fadeOut(fadeInTime, layer, group, fadeOutMode, pauseFadeOut);

            this._lastAnimationState = BaseObject.borrowObject(AnimationState);
            this._lastAnimationState._layer = layer;
            this._lastAnimationState._group = group;
            this._lastAnimationState.additiveBlending = additiveBlending;
            this._lastAnimationState.displayControl = displayControl;
            this._lastAnimationState._fadeIn(
                this._armature, clipData.animation || clipData, animationName,
                playTimes, clipData.position, clipData.duration, this._time, 1 / clipData.scale, fadeInTime,
                pauseFadeIn
            );
            this._animationStates.push(this._lastAnimationState);
            this._animationStateDirty = true;
            this._time = 0;

            if (this._animationStates.length > 1) {
                this._animationStates.sort(Animation._sortAnimationState);
            }

            const slots = this._armature.getSlots();
            for (let i = 0, l = slots.length; i < l; ++i) {
                const slot = slots[i];
                if (slot.inheritAnimation) {
                    const childArmature = slot.childArmature;
                    if (
                        childArmature &&
                        childArmature.animation.hasAnimation(animationName) &&
                        !childArmature.animation.getState(animationName)
                    ) {
                        childArmature.animation.fadeIn(animationName);
                    }
                }
            }

            if (fadeInTime == 0) {
                this._armature._delayAdvanceTime = 0;
            }

            return this._lastAnimationState;
        }
		/**
		 * @language zh_CN
		 * 指定名称的动画从指定时间开始播放。
		 * @param animationName 动画数据的名称。
		 * @param time 指定时间。 (以秒为单位，默认: 0)
		 * @param playTimes 动画循环播放的次数。 [-1: 使用动画数据默认值, 0: 无限循环播放, [1~N]: 循环播放 N 次] (默认: -1)
		 * @return 返回控制这个动画数据的动画状态。
		 * @see dragonBones.animation.AnimationState
		 * @version DragonBones 4.5
		 */
        public gotoAndPlayByTime(animationName: string, time: number = 0, playTimes: number = -1): AnimationState {
            this._time = time;

            return this.fadeIn(animationName, 0, playTimes, 0, null, AnimationFadeOutMode.All);
        }
		/**
		 * @language zh_CN
		 * 指定名称的动画从指定帧开始播放。
		 * @param animationName 动画数据的名称。
		 * @param time 指定帧。 (默认: 0)
		 * @param playTimes 动画循环播放的次数。[-1: 使用动画数据默认值, 0: 无限循环播放, [1~N]: 循环播放 N 次] (默认: -1)
		 * @return 返回控制这个动画数据的动画状态。
		 * @see dragonBones.animation.AnimationState
		 * @version DragonBones 4.5
		 */
        public gotoAndPlayByFrame(animationName: string, frame: number = 0, playTimes: number = -1): AnimationState {
            const clipData = this._animations[animationName];
            if (clipData) {
                this._time = clipData.duration * frame / clipData.frameCount;
            }

            return this.fadeIn(animationName, 0, playTimes, 0, null, AnimationFadeOutMode.All);
        }
		/**
		 * @language zh_CN
		 * 指定名称的动画从指定进度开始播放。
		 * @param animationName 动画数据的名称。
		 * @param time 进度。 [0~1] (默认: 0)
		 * @param playTimes 动画循环播放的次数。[-1: 使用动画数据默认值, 0: 无限循环播放, [1~N]: 循环播放 N 次] (默认: -1)
		 * @return 返回控制这个动画数据的动画状态。
		 * @see dragonBones.animation.AnimationState
		 * @version DragonBones 4.5
		 */
        public gotoAndPlayByProgress(animationName: string, progress: number = 0, playTimes: number = -1): AnimationState {
            const clipData = this._animations[animationName];
            if (clipData) {
                this._time = clipData.duration * Math.max(progress, 0);
            }

            return this.fadeIn(animationName, 0, playTimes, 0, null, AnimationFadeOutMode.All);
        }
		/**
		 * @language zh_CN
		 * 播放指定名称的动画到指定的时间并停止。
		 * @param animationName 动画数据的名称。
		 * @param time 指定的时间。 (以秒为单位，默认: 0)
		 * @return 返回控制这个动画数据的动画状态。
		 * @see dragonBones.animation.AnimationState
		 * @version DragonBones 4.5
		 */
        public gotoAndStopByTime(animationName: string, time: number = 0): AnimationState {
            const animationState = this.gotoAndPlayByTime(animationName, time, 1);
            if (animationState) {
                animationState.stop();
            }

            return animationState;
        }
		/**
		 * @language zh_CN
		 * 播放指定名称的动画到指定的帧并停止。
		 * @param animationName 动画数据的名称。
		 * @param time 帧。 (默认: 0)
		 * @return 返回控制这个动画数据的动画状态。
		 * @see dragonBones.animation.AnimationState
		 * @version DragonBones 4.5
		 */
        public gotoAndStopByFrame(animationName: string, frame: number = 0): AnimationState {
            const animationState = this.gotoAndPlayByFrame(animationName, frame, 1);
            if (animationState) {
                animationState.stop();
            }

            return animationState;
        }
		/**
		 * @language zh_CN
		 * 播放指定名称的动画到指定的进度并停止。
		 * @param animationName 动画数据的名称。
		 * @param time 指定的进度。 [0~1] (默认: 0)
		 * @return 返回控制这个动画数据的动画状态。
		 * @see dragonBones.animation.AnimationState
		 * @version DragonBones 4.5
		 */
        public gotoAndStopByProgress(animationName: string, progress: number = 0): AnimationState {
            const animationState = this.gotoAndPlayByProgress(animationName, progress, 1);
            if (animationState) {
                animationState.stop();
            }

            return animationState;
        }

        public getState(animationName: string): AnimationState {
            for (let i = 0, l = this._animationStates.length; i < l; ++i) {
                const animationState = this._animationStates[i];
                if (animationState.name == animationName) {
                    return animationState;
                }
            }

            return null;
        }

        public hasAnimation(animationName: string): boolean {
            return this._animations[animationName] != null;
        }

        public get isPlaying(): boolean {
            return this._isPlaying;
        }

        public get isCompleted(): boolean {
            if (this._lastAnimationState) {
                if (!this._lastAnimationState.isCompleted) {
                    return false;
                }

                for (let i = 0, l = this._animationStates.length; i < l; ++i) {
                    if (!this._animationStates[i].isCompleted) {
                        return false;
                    }
                }
            }

            return true;
        }

        public get lastAnimationName(): string {
            return this._lastAnimationState ? this._lastAnimationState.name : null;
        }

        public get lastAnimationState(): AnimationState {
            return this._lastAnimationState;
        }

        public get animationNames(): Array<string> {
            return this._animationNames;
        }

        public get animations(): Map<AnimationData> {
            return this._animations;
        }
        public set animations(value: Map<AnimationData>) {
            if (this._animations == value) {
                return;
            }

            for (let i in this._animations) {
                delete this._animations[i];
            }

            this._animationNames.length = 0;

            if (value) {
                for (let i in value) {
                    this._animations[i] = value[i];
                    this._animationNames.push(i);
                }
            }
        }

		/**
		 * 不推荐使用
		 * @see #dragonBones.Animation.play()
		 * @see #dragonBones.Animation.fadeIn()
		 * @see #dragonBones.Animation.fadeIn()
		 */
        public gotoAndPlay(
            animationName: string, fadeInTime: number = -1, duration: number = -1, playTimes: number = -1,
            layer: number = 0, group: string = null, fadeOutMode: AnimationFadeOutMode = AnimationFadeOutMode.SameLayerAndGroup,
            pauseFadeOut: boolean = true, pauseFadeIn: boolean = true
        ): AnimationState {
            const animationState = this.fadeIn(animationName, fadeInTime, playTimes, layer, group, fadeOutMode, false, true, pauseFadeOut, pauseFadeIn);
            if (animationState && duration && duration > 0) {
                animationState.timeScale = animationState.totalTime / duration;
            }

            return animationState;
        }
		/**
		 * 不推荐使用
		 * @see #dragonBones.Animation.gotoAndStopByTime()
		 * @see #dragonBones.Animation.gotoAndStopByFrame()
		 * @see #dragonBones.Animation.gotoAndStopByProgress()
		 */
        public gotoAndStop(animationName: string, time: number = 0): AnimationState {
            return this.gotoAndStopByTime(animationName, time);
        }
		/**
		 * 不推荐使用
		 * @see #dragonBones.Animation.animationNames
		 * @see #dragonBones.Animation.animations
		 */
        public get animationList(): Array<string> {
            return this._animationNames;
        }
		/**
		 * 不推荐使用
		 * @see #dragonBones.Animation.animationNames
		 * @see #dragonBones.Animation.animations
		 */
        public get animationDataList(): Array<AnimationData> {
            const list: AnimationData[] = [];
            for (let i = 0, l = this._animationNames.length; i < l; ++i) {
                list.push(this._animations[this._animationNames[i]]);
            }

            return list;
        }
    }
}