var gulp = require('gulp');
var umd = require('gulp-umd');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');


gulp.task('build', function() {
    return gulp.src('./src/module/SmartInput.js')
        .pipe(umd())
        .pipe(gulp.dest('./dist'))
        .pipe(concat('SmartInput.min.js'))
        .pipe(uglify({
            compress: true,
            mangle: true
        }))
        .pipe(gulp.dest('./dist'))
    ;
});

gulp.task('default', gulp.series('build'));